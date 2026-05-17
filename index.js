import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/AuthenticationRoutes.js';
import invitationRoutes from './routes/InvitationRoutes.js';
import templateRoutes from './routes/TemplateRoutes.js';
import userRoutes from './routes/UserRoutes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(express.json()); 
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use('/auth',authRoutes);
app.use('/invitations',invitationRoutes);
app.use('/templates',templateRoutes);
app.use('/users', userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  connectDB();
  console.log(`Server is running on port ${PORT}`);
});