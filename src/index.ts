import { Client, Collection, REST, GatewayIntentBits, Routes, Events, SlashCommandBuilder } from "discord.js";
import fs from "node:fs";
import path from "node:path";

declare module "bun" {
  interface Env {
    TOKEN: string;
    CLIENT_ID: string;
  }
}
class ExtendedClient extends Client {
  commands: Collection<string, { data: SlashCommandBuilder; execute: Function }> = new Collection();

  constructor(options: ConstructorParameters<typeof Client>[0]) {
    super(options);
  }
}

const client = new ExtendedClient({ intents: [GatewayIntentBits.Guilds] });
const rest = new REST({ version: "10" }).setToken(Bun.env.TOKEN);

client.commands = new Collection();
let commands: Array<string> = [];

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath).default;
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}
try {
  console.log("Started refreshing application (/) commands.");

  await rest.put(Routes.applicationCommands(Bun.env.CLIENT_ID), {
    body: commands,
  });

  console.log("Successfully reloaded application (/) commands.");
} catch (error) {
  console.error(error);
}

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  }
});

client.login(Bun.env.TOKEN);
