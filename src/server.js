import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import User from './models/user.js';
import Post from './models/post.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.DB_CONNECT;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('MongoDB connected!');
});

app.use(bodyParser.json());
app.use(cors());

// Define your endpoints here...

app.listen(PORT, () => console.log(`Server started on port ${PORT}`)); 

// The registration endpoint with image upload
app.post('/api/auth/register', async (req, res) => {
  const { email, fullName, password, image, role } = req.body;  
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'Please provide an email, full name, and password' });
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const user = new User({ email, fullName, password: hash, image, role});
  try {
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.status(201).json({token});
  } catch (error) {
    res.status(400).json({ message: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide an email and password' });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

  res.status(200).json({ token });
}); 
// Get all users
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ message: 'Failed to retrieve users' });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
}


app.get('/api/me', async (req, res) => {
// Get logged in user
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

// Change password and email
app.put('/api/me/edit', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, email } = req.body;

  if (!currentPassword || (!newPassword && !email)) {
    return res.status(400).json({ message: 'Please provide the current password and either the new password or email' });
  }

  try {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid current password' });
    }

    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      user.password = hash;
    }

    if (email) {
      user.email = email;
    }

    await user.save();

    res.status(200).json({ message: 'Password and/or email changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password and/or email' });
  }
});



app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve user' });
  }
});

// Create a new post
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const { authorId, title, postCid, postImageUrl, description } = req.body;
    const post = new Post({ authorId, title, postCid, postImageUrl, description });
    await post.save();
    res.send(post);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Like a post
app.put('/api/posts/:postId/like/:userId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    const userId = req.params.userId;
    if (post.likedBy.includes(userId)) {
      return res.status(400).json({ message: 'You have already liked this post' });
    }
    post.likes += 1;
    post.likedBy.push(userId);
    await post.save();
    res.send(post);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get all posts
app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const posts = await Post.find();
    res.send(posts);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get posts by authorId
app.get('/api/posts/author/:authorId', authenticateToken, async (req, res) => {
  try {
    const authorId = req.params.authorId;
    const posts = await Post.find({ authorId });
    res.send(posts);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Get a single post by postCid
app.get('/api/posts/:postCid', async (req, res) => {
  try {
    const posts = await Post.find({ postCid: req.params.postCid });
    if (posts.length === 0) {
      return res.status(404).json({ message: 'No posts found with that postCid' });
    }
    const postWithAuthorPromises = posts.map(async (post) => {
      const user = await User.findById(post.authorId);
      if (!user) {
        throw new Error('User not found');
      }
      const authorName = user.fullName;
      return { ...post.toObject(), authorName };
    });
    const postsWithAuthor = await Promise.all(postWithAuthorPromises);
    res.status(200).json(postsWithAuthor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});