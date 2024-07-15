import { mockServerClient } from 'mockserver-client';
import { GraphQLClient } from 'graphql-request';
import { ObjectID } from 'mongodb';
import { createClient } from './helpers/createClient';
import {
  getChatConversationMessages,
  sendConversationMessageMutation,
  deleteConversationMessage,
  likeConversationMessage,
  unlikeConversationMessage,
  resolveConversationMessage,
  unresolveConversationMessage,
  updateConversationMessageTagsMutation,
  getChatConversationMessagesByTags,
} from './helpers/gqlSnipetts';
import {
  createConversationForTest,
  createConversationWithCommunityPermissions,
} from './helpers/conversation.utils';
import { Tag, TagType } from '../src/utils/dto.utils';

const dummyUserId = '597cfa3ac88c22000a74d167';

describe('Message', () => {
  let client: GraphQLClient;
  let anotherClient: GraphQLClient;

  beforeAll(async () => {
    const toSign = {
      identity: {
        account_role: 'applicant',
        user_id: dummyUserId,
      },
    };

    client = createClient(toSign);
    anotherClient = createClient({
      identity: {
        account_role: 'applicant',
        user_id: '597cfa3ac88c22000a74d178',
      },
    });

    await mockServerClient(process.env.MOCK_USER_SERVICE ?? '', 1080).mockSimpleResponse(
      `/api/v1/users/${dummyUserId}`,
      {
        id: dummyUserId,
        firstName: 'Ben',
        lastName: 'Giles',
        profilePhoto: null,
      },
      200,
    );
  });

  it('/graphql (POST) return 200 if a valid query is sent', async () => {
    const { id: conversationId } = await createConversationForTest();
    const result = await client.request(sendConversationMessageMutation, {
      messageDto: {
        text: 'End too end message',
        conversationId: conversationId,
      },
    });

    // Create a time variable which is ten seconds earlier than the client request
    const testDateTime = new Date(Date.now() - 10000).getTime();

    expect(result.errors).toBeUndefined();
    expect(result.sendConversationMessage).toEqual({
      id: expect.anything(),
      text: 'End too end message',
      sender: { id: '597cfa3ac88c22000a74d167' },
      resolved: false,
      created: expect.anything(),
      deleted: false,
      tags: [],
    });

    // Assert that the time the message was sent is after the testDate
    expect(
      new Date(result.sendConversationMessage.created).getTime(),
    ).toBeGreaterThan(testDateTime);
  });

  it('user can delete a message', async () => {
    const { id: conversationId } = await createConversationForTest();
    const message = await client.request(sendConversationMessageMutation, {
      messageDto: {
        text: `Message to delete`,
        conversationId: conversationId,
      },
    });

    expect(message.sendConversationMessage.deleted).toEqual(false);

    const result = await client.request(deleteConversationMessage, {
      deleteMessageDto: {
        messageId: message.sendConversationMessage.id,
        conversationId: conversationId,
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.deleteConversationMessage).toEqual({
      id: message.sendConversationMessage.id,
      text: 'This message has been deleted',
      sender: { id: '597cfa3ac88c22000a74d167' },
      created: expect.anything(),
      deleted: true,
    });

    const updatedResult = await client.request(getChatConversationMessages, {
      getMessageDto: {
        conversationId: conversationId,
        limit: 1,
      },
    });

    expect(updatedResult.getChatConversationMessages.messages.length).toEqual(
      1,
    );

    expect(updatedResult.getChatConversationMessages.messages).toEqual([
      {
        id: message.sendConversationMessage.id,
        text: 'This message has been deleted',
        sender: { id: '597cfa3ac88c22000a74d167' },
        created: expect.anything(),
        deleted: true,
        isSenderBlocked: false,
      },
    ]);
  });

  describe('Like / Unlike Messages', () => {
    it('user can like a message', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to like`,
          conversationId: conversationId,
        },
      });

      expect(message.sendConversationMessage.likes).toBeUndefined();

      const result = await client.request(likeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.likeConversationMessage).toEqual(
        expect.objectContaining({
          id: message.sendConversationMessage.id,
          text: 'Message to like',
          likes: ['597cfa3ac88c22000a74d167'],
          likesCount: 1,
          sender: { id: '597cfa3ac88c22000a74d167' },
        }),
      );
    });

    it('user can unlike a message', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to like`,
          conversationId: conversationId,
        },
      });

      expect(message.sendConversationMessage.likes).toBeUndefined();

      // like the message
      await client.request(likeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      // unlike the message
      const result = await client.request(unlikeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.unlikeConversationMessage).toEqual(
        expect.objectContaining({
          id: message.sendConversationMessage.id,
          sender: { id: '597cfa3ac88c22000a74d167' },
          likes: [],
          likesCount: 0,
        }),
      );
    });

    it('complete use case', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to like`,
          conversationId: conversationId,
        },
      });

      expect(message.sendConversationMessage.likes).toBeUndefined();

      // user likes the message
      let result = await client.request(likeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });
      expect(result.errors).toBeUndefined();
      expect(result.likeConversationMessage).toEqual(
        expect.objectContaining({
          id: message.sendConversationMessage.id,
          sender: { id: '597cfa3ac88c22000a74d167' },
          likes: ['597cfa3ac88c22000a74d167'],
          likesCount: 1,
        }),
      );

      // user 2 likes the message
      result = await client.request(likeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d166',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });
      expect(result.errors).toBeUndefined();
      expect(result.likeConversationMessage).toEqual(
        expect.objectContaining({
          id: message.sendConversationMessage.id,
          sender: { id: '597cfa3ac88c22000a74d167' },
          likes: ['597cfa3ac88c22000a74d167', '597cfa3ac88c22000a74d166'],
          likesCount: 2,
        }),
      );

      // user unlikes the message
      result = await client.request(unlikeConversationMessage, {
        likeMessageDto: {
          userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });
      expect(result.errors).toBeUndefined();
      expect(result.unlikeConversationMessage).toEqual(
        expect.objectContaining({
          id: message.sendConversationMessage.id,
          sender: { id: '597cfa3ac88c22000a74d167' },
          likes: ['597cfa3ac88c22000a74d166'],
          likesCount: 1,
        }),
      );
    });
  });

  describe('Message Tags', () => {
    it('user can update message tags', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to resolve`,
          conversationId: conversationId,
        },
      });

      expect(message.sendConversationMessage.tags).toEqual([]);

      const updatedMessage = await client.request(
        updateConversationMessageTagsMutation,
        {
          updateMessageTagsDto: {
            conversationId: conversationId,
            messageId: message.sendConversationMessage.id,
            tags: [{ id: 'course', type: TagType.subTopic }],
          },
        },
      );

      expect(updatedMessage.updateConversationMessageTags.tags).toEqual([
        { id: 'course', type: TagType.subTopic },
      ]);
    });

    it('users should be able to get messages by tags', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to resolve`,
          conversationId: conversationId,
          tags: [{ _id: "66954d19a21e1ea4481d9c8b", id: 'course', type: TagType.subTopic }],
        },
      });

      expect(message.sendConversationMessage.tags).toEqual([{ id: 'course', type: TagType.subTopic }]);

      const result = await client.request(
        getChatConversationMessagesByTags, 
        {
          getMessagesByTagsDto: {
            conversationIds: [conversationId],
            tags: [{ _id: "66954d19a21e1ea4481d9c8b", id: 'course', type: TagType.subTopic }],
            limit: 2,
          },
        },
      );

      expect(result.getChatMessagesByTags).toEqual([
        {
          _id: ["course"],
          messages: [
            {
              message: "Message to resolve",
              senderId: "597cfa3ac88c22000a74d167",
              tags: [{ id: 'course', type: TagType.subTopic }],
            },
          ],
          tagId: ["course"],
        }
      ]);
    });
  });

  describe('resolve / unresolve Messages', () => {
    it('user can resolve a message', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to resolve`,
          conversationId: conversationId,
        },
      });

      expect(message.sendConversationMessage.resolved).toBe(false);
      const result = await client.request(resolveConversationMessage, {
        resolveMessageDto: {
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.resolveConversationMessage).toEqual({
        id: message.sendConversationMessage.id,
        text: 'Message to resolve',
        resolved: true,
        sender: { id: '597cfa3ac88c22000a74d167' },
      });
    });

    it('user can unresolve a message', async () => {
      const { id: conversationId } = await createConversationForTest();
      const message = await client.request(sendConversationMessageMutation, {
        messageDto: {
          text: `Message to unresolve`,
          conversationId: conversationId,
        },
      });

      // resolve the message
      await client.request(resolveConversationMessage, {
        resolveMessageDto: {
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      // unresolve the message
      const result = await client.request(unresolveConversationMessage, {
        resolveMessageDto: {
          //userId: '597cfa3ac88c22000a74d167',
          messageId: message.sendConversationMessage.id,
          conversationId,
        },
      });

      expect(result.errors).toBeUndefined();
      expect(result.unresolveConversationMessage).toEqual({
        id: message.sendConversationMessage.id,
        text: 'Message to unresolve',
        resolved: false,
        sender: { id: '597cfa3ac88c22000a74d167' },
      });
    });
  });
});
