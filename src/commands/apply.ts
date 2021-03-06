import { MessageEmbed } from 'discord.js';
import { Message, CommandDef } from '../lib/types';
import { sleep } from '../lib/sleep';
import * as mongo from '../lib/db';
import { AppConfig } from './appconfig';
import { askQuestionWithMessageResponse } from '../lib/utils/args';

const command: CommandDef = {
  name: 'apply',
  alias: ['apply'],
  channel: 'guild',
  help: {
    description: 'This command is used to configure application questions and the channel to which completed applications are posted.',
  },
  args: async (message: Message) => {
    if (!message || !message.guild) return;

    let config: AppConfig | null = null;
    const client = mongo.getClient();
    try {
      await client.connect();
      config = await client.getDb()
        .collection(mongo.collections.appconfig)
        .findOne<AppConfig>({ id: message.guild.id });
    } catch (err) {
      console.error(err);
      message.channel.send(`I'm sorry, there was a problem with processing this command.`);
      return;
    } finally {
      await client.close();
    }

    if (!config) return;

    const responses: any = [];
    for (const question of config.questions) {
      const answer = await askQuestionWithMessageResponse(question, message.channel, { name: 'answer', type: 'content' });
      
      responses.push({
        question: question,
        answer,
      });
      await sleep(500);
    }

    return {
      responses
    }
  },
  handler: async (message: Message, args: { responses: { question: string; answer: string; }[]; }) => {
    if (!message.guild || !args) return;
    
    const client = mongo.getClient();
    let config: AppConfig | null = null;
    try {
      await client.connect();
      config = await client.getDb()
        .collection(mongo.collections.appconfig)
        .findOne<AppConfig>({ id: message.guild.id });
    } catch (err) {
      console.error(err);
    } finally {
      await client.close();
    }
    
    if (!config) {
      return;
    }
    
    message.client.channels
      .fetch(config.appChannel)
      .then((channel: any) => channel.send(new MessageEmbed()
        .setColor("#FF0000")
        .setTitle(`New Application for ${message.author.username}`)
        .addFields(args.responses.map((a: { question: string; answer: string}) => ({ name: a.question, value: a.answer })))
        .addField('ID', message.author)
        .addField('Channel', message.channel)
      ));
    
      return message.reply(`Thank you, your application was submitted! Please wait while it is reviewed someone will get back with you soon.`);
  }
};

export default command;
