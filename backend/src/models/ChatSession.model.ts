import mongoose, { Schema, Document } from 'mongoose';

export interface IChatSessionDoc extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  title: string;
  pinned: boolean;
  lastMessage?: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema = new Schema<IChatSessionDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'New Financial Research',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    lastMessage: {
      type: String,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const ChatSession = mongoose.model<IChatSessionDoc>('ChatSession', ChatSessionSchema);
