// GraphQL Server for WatchTogether
// Replaces WebSocket signaling with GraphQL subscriptions and mutations

const { ApolloServer } = require('apollo-server-express');
const { PubSub } = require('graphql-subscriptions');
const { createServer } = require('http');
const express = require('express');
const { execute, subscribe } = require('graphql');
const { SubscriptionServer } = require('subscriptions-transport-ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');

// In-memory storage (in production, use Redis or database)
const rooms = new Map(); // roomId -> Set of sessionIds
const sessions = new Map(); // sessionId -> { roomId, lastSeen, userInfo }
const messages = new Map(); // roomId -> Array of messages
const playerEvents = new Map(); // roomId -> Array of events

// PubSub for real-time subscriptions
const pubsub = new PubSub();

// GraphQL Schema
const typeDefs = `
  type User {
    sessionId: String!
    roomId: String!
    nickname: String
    lastSeen: String!
    isHost: Boolean!
  }

  type Message {
    id: String!
    text: String!
    sender: String!
    sessionId: String!
    timestamp: String!
    roomId: String!
  }

  type PlayerEvent {
    id: String!
    action: String!
    currentTime: Float!
    timestamp: String!
    sessionId: String!
    roomId: String!
  }

  type Room {
    id: String!
    users: [User!]!
    messages: [Message!]!
    playerEvents: [PlayerEvent!]!
    userCount: Int!
  }

  type Query {
    room(roomId: String!): Room
    user(sessionId: String!): User
    rooms: [Room!]!
  }

  type Mutation {
    joinRoom(roomId: String!, sessionId: String!, nickname: String): User!
    leaveRoom(sessionId: String!): Boolean!
    sendMessage(roomId: String!, sessionId: String!, text: String!, sender: String!): Message!
    sendPlayerEvent(roomId: String!, sessionId: String!, action: String!, currentTime: Float!): PlayerEvent!
    updateUser(sessionId: String!, nickname: String): User!
    heartbeat(sessionId: String!): Boolean!
  }

  type Subscription {
    userJoined(roomId: String!): User!
    userLeft(roomId: String!): User!
    messageReceived(roomId: String!): Message!
    playerEventReceived(roomId: String!): PlayerEvent!
    roomUpdated(roomId: String!): Room!
  }
`;

// Resolvers
const resolvers = {
  Query: {
    room: (_, { roomId }) => {
      const roomUsers = rooms.get(roomId) || new Set();
      const roomMessages = messages.get(roomId) || [];
      const roomEvents = playerEvents.get(roomId) || [];
      
      return {
        id: roomId,
        users: Array.from(roomUsers).map(sessionId => sessions.get(sessionId)).filter(Boolean),
        messages: roomMessages.slice(-50), // Last 50 messages
        playerEvents: roomEvents.slice(-20), // Last 20 events
        userCount: roomUsers.size
      };
    },
    
    user: (_, { sessionId }) => {
      return sessions.get(sessionId);
    },
    
    rooms: () => {
      return Array.from(rooms.keys()).map(roomId => ({
        id: roomId,
        users: Array.from(rooms.get(roomId) || []).map(sessionId => sessions.get(sessionId)).filter(Boolean),
        messages: (messages.get(roomId) || []).slice(-50),
        playerEvents: (playerEvents.get(roomId) || []).slice(-20),
        userCount: (rooms.get(roomId) || new Set()).size
      }));
    }
  },

  Mutation: {
    joinRoom: (_, { roomId, sessionId, nickname }) => {
      console.log(`[GraphQL] ${sessionId} joining room ${roomId}`);
      
      // Create room if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
        messages.set(roomId, []);
        playerEvents.set(roomId, []);
      }
      
      const room = rooms.get(roomId);
      const isHost = room.size === 0; // First user is host
      
      // Add user to room
      room.add(sessionId);
      
      // Store user info
      const user = {
        sessionId,
        roomId,
        nickname: nickname || `User${Math.floor(Math.random() * 1000)}`,
        lastSeen: new Date().toISOString(),
        isHost
      };
      
      sessions.set(sessionId, user);
      
      // Publish user joined event
      pubsub.publish('USER_JOINED', {
        userJoined: user,
        roomId
      });
      
      // Publish room update
      pubsub.publish('ROOM_UPDATED', {
        roomUpdated: {
          id: roomId,
          users: Array.from(room).map(sid => sessions.get(sid)).filter(Boolean),
          messages: (messages.get(roomId) || []).slice(-50),
          playerEvents: (playerEvents.get(roomId) || []).slice(-20),
          userCount: room.size
        },
        roomId
      });
      
      console.log(`[GraphQL] Room ${roomId} now has ${room.size} users`);
      return user;
    },
    
    leaveRoom: (_, { sessionId }) => {
      const user = sessions.get(sessionId);
      if (!user) return false;
      
      const { roomId } = user;
      const room = rooms.get(roomId);
      
      if (room) {
        room.delete(sessionId);
        
        // Publish user left event
        pubsub.publish('USER_LEFT', {
          userLeft: user,
          roomId
        });
        
        // Publish room update
        pubsub.publish('ROOM_UPDATED', {
          roomUpdated: {
            id: roomId,
            users: Array.from(room).map(sid => sessions.get(sid)).filter(Boolean),
            messages: (messages.get(roomId) || []).slice(-50),
            playerEvents: (playerEvents.get(roomId) || []).slice(-20),
            userCount: room.size
          },
          roomId
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomId);
          messages.delete(roomId);
          playerEvents.delete(roomId);
          console.log(`[GraphQL] Room ${roomId} deleted (empty)`);
        } else {
          console.log(`[GraphQL] Room ${roomId} now has ${room.size} users`);
        }
      }
      
      // Remove user session
      sessions.delete(sessionId);
      
      return true;
    },
    
    sendMessage: (_, { roomId, sessionId, text, sender }) => {
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        text,
        sender,
        sessionId,
        timestamp: new Date().toISOString(),
        roomId
      };
      
      // Store message
      const roomMessages = messages.get(roomId) || [];
      roomMessages.push(message);
      
      // Keep only last 100 messages
      if (roomMessages.length > 100) {
        roomMessages.splice(0, roomMessages.length - 100);
      }
      
      messages.set(roomId, roomMessages);
      
      // Publish message
      pubsub.publish('MESSAGE_RECEIVED', {
        messageReceived: message,
        roomId
      });
      
      console.log(`[GraphQL] Message sent in room ${roomId}: ${text}`);
      return message;
    },
    
    sendPlayerEvent: (_, { roomId, sessionId, action, currentTime }) => {
      const event = {
        id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        action,
        currentTime,
        timestamp: new Date().toISOString(),
        sessionId,
        roomId
      };
      
      // Store event
      const roomEvents = playerEvents.get(roomId) || [];
      roomEvents.push(event);
      
      // Keep only last 50 events
      if (roomEvents.length > 50) {
        roomEvents.splice(0, roomEvents.length - 50);
      }
      
      playerEvents.set(roomId, roomEvents);
      
      // Publish event
      pubsub.publish('PLAYER_EVENT_RECEIVED', {
        playerEventReceived: event,
        roomId
      });
      
      console.log(`[GraphQL] Player event sent in room ${roomId}: ${action} at ${currentTime}s`);
      return event;
    },
    
    updateUser: (_, { sessionId, nickname }) => {
      const user = sessions.get(sessionId);
      if (!user) {
        throw new Error('User not found');
      }
      
      user.nickname = nickname;
      user.lastSeen = new Date().toISOString();
      
      // Publish room update
      pubsub.publish('ROOM_UPDATED', {
        roomUpdated: {
          id: user.roomId,
          users: Array.from(rooms.get(user.roomId) || []).map(sid => sessions.get(sid)).filter(Boolean),
          messages: (messages.get(user.roomId) || []).slice(-50),
          playerEvents: (playerEvents.get(user.roomId) || []).slice(-20),
          userCount: (rooms.get(user.roomId) || new Set()).size
        },
        roomId: user.roomId
      });
      
      return user;
    },
    
    heartbeat: (_, { sessionId }) => {
      const user = sessions.get(sessionId);
      if (user) {
        user.lastSeen = new Date().toISOString();
        return true;
      }
      return false;
    }
  },

  Subscription: {
    userJoined: {
      subscribe: (_, { roomId }) => {
        return pubsub.asyncIterator(['USER_JOINED']);
      },
      resolve: (payload, args) => {
        if (payload.userJoined.roomId === args.roomId) {
          return payload.userJoined;
        }
        return null;
      }
    },
    
    userLeft: {
      subscribe: (_, { roomId }) => {
        return pubsub.asyncIterator(['USER_LEFT']);
      },
      resolve: (payload, args) => {
        if (payload.userLeft.roomId === args.roomId) {
          return payload.userLeft;
        }
        return null;
      }
    },
    
    messageReceived: {
      subscribe: (_, { roomId }) => {
        return pubsub.asyncIterator(['MESSAGE_RECEIVED']);
      },
      resolve: (payload, args) => {
        if (payload.messageReceived.roomId === args.roomId) {
          return payload.messageReceived;
        }
        return null;
      }
    },
    
    playerEventReceived: {
      subscribe: (_, { roomId }) => {
        return pubsub.asyncIterator(['PLAYER_EVENT_RECEIVED']);
      },
      resolve: (payload, args) => {
        if (payload.playerEventReceived.roomId === args.roomId) {
          return payload.playerEventReceived;
        }
        return null;
      }
    },
    
    roomUpdated: {
      subscribe: (_, { roomId }) => {
        return pubsub.asyncIterator(['ROOM_UPDATED']);
      },
      resolve: (payload, args) => {
        if (payload.roomUpdated.id === args.roomId) {
          return payload.roomUpdated;
        }
        return null;
      }
    }
  }
};

// Create schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Cleanup inactive users every 30 seconds
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 60000; // 1 minute
  
  for (const [sessionId, user] of sessions.entries()) {
    const lastSeen = new Date(user.lastSeen);
    if (now - lastSeen > inactiveThreshold) {
      console.log(`[GraphQL] Removing inactive user: ${sessionId}`);
      
      // Remove from room
      const room = rooms.get(user.roomId);
      if (room) {
        room.delete(sessionId);
        
        // Publish user left event
        pubsub.publish('USER_LEFT', {
          userLeft: user,
          roomId: user.roomId
        });
        
        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(user.roomId);
          messages.delete(user.roomId);
          playerEvents.delete(user.roomId);
        }
      }
      
      sessions.delete(sessionId);
    }
  }
}, 30000);

// Create Express app
const app = express();

// Create Apollo Server
const server = new ApolloServer({
  schema,
  context: ({ req }) => {
    return {
      req,
      pubsub
    };
  },
  formatError: (error) => {
    console.error('[GraphQL] Error:', error);
    return error;
  }
});

// Start server
async function startServer() {
  await server.start();
  
  server.applyMiddleware({ app });
  
  const httpServer = createServer(app);
  
  // Set up WebSocket for subscriptions
  SubscriptionServer.create(
    {
      schema,
      execute,
      subscribe,
      onConnect: (connectionParams) => {
        console.log('[GraphQL] Client connected:', connectionParams);
      },
      onDisconnect: () => {
        console.log('[GraphQL] Client disconnected');
      }
    },
    {
      server: httpServer,
      path: server.graphqlPath
    }
  );
  
  const port = process.env.PORT || 4000;
  
  httpServer.listen(port, () => {
    console.log(`[GraphQL] Server running on http://localhost:${port}${server.graphqlPath}`);
    console.log(`[GraphQL] Subscriptions ready on ws://localhost:${port}${server.graphqlPath}`);
  });
}

// Start if run directly
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = { schema, resolvers, pubsub, startServer }; 