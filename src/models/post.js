import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const postSchema = new Schema({
  authorId: String,
  postCid: String,
  title: String,
  postImageUrl: String,
  description: String,
  likes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }]
});

  const Post = model('Post', postSchema);
  export default Post;