import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import {OAuth2Client} from 'google-auth-library';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const RECAPTCHA_ACTIONS = {
  signup: 'signup',
  vendorSignup: 'vendor_signup',
};
const RECAPTCHA_SCORE_THRESHOLD = Number(process.env.RECAPTCHA_SCORE_THRESHOLD || 0.5);

const verifyRecaptchaToken = async (captchaToken, expectedAction) => {
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    return { success: false, message: 'reCAPTCHA is not configured on the server.' };
  }

  if (!captchaToken) {
    return { success: false, message: 'reCAPTCHA verification failed. Please try again.' };
  }

  const body = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: captchaToken,
  });

  const response = await fetch(RECAPTCHA_VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const result = await response.json();

  if (!result.success) {
    return { success: false, message: 'reCAPTCHA verification failed. Please try again.' };
  }

  if (typeof result.score === 'number' && result.score < RECAPTCHA_SCORE_THRESHOLD) {
    return { success: false, message: 'reCAPTCHA score was too low. Please try again.' };
  }

  if (expectedAction && result.action && result.action !== expectedAction) {
    return { success: false, message: 'reCAPTCHA action did not match the request.' };
  }

  return { success: true };
};
/**
 * @desc    Register a new user
 * @route   POST /auth/register
 * @access  Public
 */
export const registerUser = async (req, res) => {
  const { name, email, password, role, number, googleMyBusinessLink, captchaToken } = req.body;
  try {    
    const recaptchaResult = await verifyRecaptchaToken(captchaToken, RECAPTCHA_ACTIONS.signup);
    if (!recaptchaResult.success) {
      return res.status(400).json({ message: recaptchaResult.message, success: false });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists',success:false });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ 
      name,
      email,
      password: hashedPassword, 
      number,
      googleMyBusinessLink,
      role
       });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('customerAccessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ message: 'User registered successfully', success: true, token });
  } catch (error) {
    res.status(500).json({ message: 'Server error',success:false });
  }
};

/**
 * @desc    Register a new vendor
 * @route   POST /auth/vendor/register
 * @access  Public
 */
export const registerVendor = async (req, res) => {
  const { email, password, number, googleMyBusinessLink, businessName, gstNumber, captchaToken } = req.body;
  try {
    const recaptchaResult = await verifyRecaptchaToken(captchaToken, RECAPTCHA_ACTIONS.vendorSignup);
    if (!recaptchaResult.success) {
      return res.status(400).json({ message: recaptchaResult.message, success: false });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists', success: false });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name: req.body.name || email,
      businessName,
      email,
      password: hashedPassword,
      number,
      googleMyBusinessLink,
      gstNumber,
      isVendorAuthenticate: false,
      role: 'vendor',
    });

    await newUser.save();
    res.status(201).json({ message: 'Vendor registered successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
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
    res.cookie('customerAccessToken', token, {
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
 * @desc    Login a vendor
 * @route   POST /auth/vendor/login
 * @access  Public
 */
export const loginVendor = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.role !== 'vendor') {
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }

    if (!user.isVendorAuthenticate) {
      return res.status(403).json({ message: 'Waiting for confirmation', success: false });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('vendorAccessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ token, success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
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
    res.cookie('adminAccessToken', token, {
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
export const getCustomer = async (req, res) => {
  try {
    const authToken = req.cookies?.customerAccessToken 
    if (!authToken) return res.status(200).json({ message: 'Not authenticated', success: false });
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(200).json({ message: 'User not found', success: false });
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('getMe error', error.message);
    return res.status(200).json({ message: 'Server error', success: false });
  }
};

/**
 * @desc    Return current vendor info from token
 * @route   GET /auth/me
 * @access  Private (uses cookie)
 */
export const getVendor = async (req, res) => {
  try {
    const authToken = req.cookies?.vendorAccessToken  
    if (!authToken) return res.status(401).json({ message: 'Not authenticated', success: false });
    const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found', success: false });
    return res.status(200).json({ success: true, user });
  }
    catch (error) {
    console.error('getMe error', error.message);
    return res.status(500).json({ message: 'Server error', success: false });
  }
};

/**
 * @desc    Return current admin info from token
 * @route   GET /auth/me
 * @access  Private (uses cookie)
 */
export const getAdmin = async (req, res) => {
  try {
    const authToken = req.cookies?.adminAccessToken
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
 * @desc    Logout current user
 * @route   POST /auth/logout
 * @access  Public
 */
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie('customerAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.clearCookie('vendorAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.clearCookie('adminAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
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
    res.cookie('customerAccessToken', accesstoken, {
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