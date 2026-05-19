import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import {OAuth2Client} from 'google-auth-library';
/**
 * @desc    Register a new user
 * @route   POST /auth/register
 * @access  Public
 */
export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists',success:false });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      name,
      email,
      password: hashedPassword, 
      role
       });
    await newUser.save();
    res.status(201).json({ message: 'User registered successfully',success:true });
  } catch (error) {
    res.status(500).json({ message: 'Server error',success:false });
  }
};

/**
 * @desc    Login a user
 * @route   POST/auth/login
 * @access  Public
 */
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials',success:false });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials',success:false });
    } 
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('accesstoken', token, {
       httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
    res.status(200).json({ token,success:true });
  } catch (error) {
    res.status(500).json({ message: 'Server error',success:false });
  }
};

/**
 * @desc    Login as admin
 * @route   POST /auth/login-admin
 * @access  Public
 */
export const loginAdmin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized access', success: false });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('accesstoken', token, {
      httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
    res.status(200).json({ token, success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
  }
};

/**
 * @desc    Return current user info from token
 * @route   GET /auth/me
 * @access  Private (uses cookie)
 */
export const getMe = async (req, res) => {
  try {
    const authToken = req.cookies?.accesstoken;
    if (!authToken) return res.status(401).json({ message: 'Not authenticated', success: false });
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found', success: false });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('getMe error', error.message);
    return res.status(500).json({ message: 'Server error', success: false });
  }
};

/**
 * @desc    Google OAuth login
 * @route   POST /auth/google
 * @access  Public
 */

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
export const googleLogin = async (req,res)=>{
  try {
    const {token} = req.body;
    const ticket = await client.verifyIdToken({
      idToken:token,
      audience:process.env.GOOGLE_CLIENT_ID
    })
    const {name,email} = ticket.getPayload();
    const {role} = req.body;
    let user = await User.findOne({email});
    if(!user){
      user = await User.create({
        name,
        email,
        password:"",
        role
      })
    }
    const accesstoken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('accesstoken', accesstoken, {
       httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
      });
    res.status(200).json({ message: 'Login successful', accesstoken, success:true });
  } catch (error) {
    console.log("Error during google login:", error.message);
    res.status(500).json({ message: 'Server error', success:false });
  }
}