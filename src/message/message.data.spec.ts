import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ObjectID } from 'mongodb';
import { MessageData } from './message.data';
import { ChatMessageModel, ChatMessageSchema } from './models/message.model';

import { ConfigManagerModule } from '../configuration/configuration-manager.module';
import {getTestConfiguration}  from '../configuration/configuration-manager.utils';
import { Tag, TagType } from '../utils/dto.utils';

const id = new ObjectID('5fe0cce861c8ea54018385af');
const conversationId = new ObjectID();
const senderId = new ObjectID('5fe0cce861c8ea54018385af');
const sender2Id = new ObjectID('5fe0cce861c8ea54018385aa');
const sender3Id = new ObjectID('5fe0cce861c8ea54018385ab');
const tag1 = new Tag();
tag1.id = 'tag1';
tag1.type = TagType.subTopic;
const tag2 = new Tag();
tag2.id = 'tag2';
tag2.type = TagType.subTopic;
const tag3 = new Tag();
tag3.id = 'tag3';
tag3.type = TagType.subTopic;
const tags = [tag1, tag2];

class TestMessageData extends MessageData {
  async deleteMany() {
    await this.chatMessageModel.deleteMany();
  }
}

describe('MessageData', () => {
  let messageData: TestMessageData;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRootAsync({
          imports: [ConfigManagerModule],
          useFactory: () => {
            const databaseConfig =
              getTestConfiguration().database;
            return {
              uri: databaseConfig.connectionString,
            };
          },
        }),
        MongooseModule.forFeature([
          { name: ChatMessageModel.name, schema: ChatMessageSchema },
        ]),
      ],
      providers: [TestMessageData],
    }).compile();

    messageData = module.get<TestMessageData>(TestMessageData);
  });

  beforeEach(
    async () => {
      messageData.deleteMany();
    }
  );

  afterEach(async () => {
    messageData.deleteMany();
  });

  it('should be defined', () => {
    expect(messageData).toBeDefined();
  });

  describe('create', () => {
    it('should be defined', () => {
      expect(messageData.create).toBeDefined();
    });

    it('successfully creates a message', async () => {
      const conversationId = new ObjectID();
      const message = await messageData.create(
        { conversationId, text: 'Hello world' },
        senderId,
      );

      expect(message).toMatchObject(
        {
        likes: [],
        resolved: false,
        deleted: false,
        reactions: [],
        text: 'Hello world',
        senderId: senderId,
        conversationId: conversationId,
        conversation: { id: conversationId.toHexString() },
        likesCount: 0,
        sender: { id: senderId.toHexString() },
        tags: [],
      });
    });
  });

  describe('updateTags', () => {
    it('should be defined', () => {
      expect(messageData.updateTags).toBeDefined();
    });

    it('should update message tags', async () => {
      const conversationId = new ObjectID();

      const expectedMessage = {
        likes: [],
        resolved: false,
        deleted: false,
        reactions: [],
        text: 'Message to update',
        senderId: senderId,
        conversationId: conversationId,
        conversation: { id: conversationId.toHexString() },
        likesCount: 0,
        sender: { id: senderId.toHexString() },
        tags: tags,
      };

      const message = await messageData.create(
        { conversationId, text: 'Message to update', tags: tags },
        senderId,
      );

      // ensure tags are set when message is created
      expect(message).toMatchObject(expectedMessage);

      const updatedTags = [tag1, tag2, tag3];
      const updatedMessage = await messageData.updateTags(
        message.id,
        updatedTags,
      );
      expectedMessage.tags = updatedTags;

      expect(updatedMessage).toMatchObject(expectedMessage);

      // confirm it is updated
      const retrievedMessage = await messageData.getMessage(
        message.id.toHexString(),
      );
      expect(retrievedMessage).toMatchObject(expectedMessage);
    });

    it('should throw exception when message does not exist', async () => {
      expect(messageData.updateTags(new ObjectID(), tags)).rejects.toThrow(
        'Could not update tags on message',
      );
    });
  });


  describe('get', () => {
    it('should be defined', () => {
      expect(messageData.getMessage).toBeDefined();
    });

    it('successfully gets a message', async () => {
      const conversationId = new ObjectID();
      const sentMessage = await messageData.create(
        { conversationId, text: 'Hello world' },
        senderId,
      );

      const gotMessage = await messageData.getMessage(sentMessage.id.toHexString())

      expect(gotMessage).toMatchObject(sentMessage)
    });
  });

  describe('getMessagesByTags', () => {
    it('should be defined', () => {
      expect(messageData.getMessagesByTags).toBeDefined();
    });

    it('should filter messages based on tags', async () => {
      const conversationId = new ObjectID();
      const firstMessage = await messageData.create(
        { conversationId, text: 'Hello world', tags: tags },
        senderId,
      );
      await messageData.create(
        { conversationId, text: 'Second Message', tags: [tag3] },
        senderId,
      );

      const expectedResult = [
        {
          _id: ["tag1", "tag2"],
          messages: [
            {
              message: "Hello world",
              senderId: senderId.toHexString(),
              tags: tags,
            },
          ],
          tagId: ["tag1", "tag2"],
        }
      ];

      const result = await messageData.getMessagesByTags([conversationId], firstMessage.tags!, 5);

      expect(result).toMatchObject(expectedResult);
    });
  });

  describe('delete', () => {
    it('successfully marks a message as deleted', async () => {
      const conversationId = new ObjectID();
      const message = await messageData.create(
        { conversationId, text: 'Message to delete' },
        senderId,
      );

      // Make sure that it started off as not deleted
      expect(message.deleted).toEqual(false);

      const deletedMessage = await messageData.delete(new ObjectID(message.id));
      expect(deletedMessage.deleted).toEqual(true);

      // And that is it now deleted
      const retrievedMessage = await messageData.getMessage(message.id.toHexString())
      expect(retrievedMessage.deleted).toEqual(true);
    });
  });
});
