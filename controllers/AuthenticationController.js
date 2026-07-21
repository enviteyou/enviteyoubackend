import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import User from '../models/user.js';
import { OAuth2Client } from 'google-auth-library';

const createMailTransport = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!user || !pass) {
    throw new Error('Email credentials are not configured');
  }

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

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
      return res.status(400).json({ message: 'User already exists', success: false });
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
      partitioned: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ message: 'User registered successfully', success: true, token });
  } catch (error) {

    res.status(500).json({ message: error.message, success: false });
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
    res.status(500).json({ message: error.message, success: false });
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
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials', success: false });
    }
    if (user.role === 'vendor') {
      return res.status(400).json({ message: 'Invalid user credentials.Please login in vendor panel', role: user.role, success: false });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Invalid user credentials.Please login in admin panel', role: user.role, success: false });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('customerAccessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production', // CHIPS specification: allows modern Incognito to accept cross-site auth cookies
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.status(200).json({ token, success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false });
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
      partitioned: process.env.NODE_ENV === 'production',
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
      partitioned: process.env.NODE_ENV === 'production',
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
      partitioned: process.env.NODE_ENV === 'production',
      path: '/',
    });
    res.clearCookie('vendorAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      partitioned: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.clearCookie('adminAccessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      partitioned: process.env.NODE_ENV === 'production',
      path: '/',
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
export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    })
    const { name, email } = ticket.getPayload();
    const { role } = req.body;
    let user = await User.findOne({ email });
    if (user.role === 'vendor') {
      return res.status(400).json({ message: 'Invalid user credentials.Please login in vendor panel', role: user.role, success: false });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Invalid user credentials.Please login in admin panel', role: user.role, success: false });
    }
    if (!user) {
      user = await User.create({
        name,
        email,
        password: "",
        role
      })
    }
    const accesstoken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('customerAccessToken', accesstoken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      partitioned: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    res.status(200).json({ message: 'Login successful', accesstoken, success: true });
  } catch (error) {
    console.log("Error during google login:", error.message);
    res.status(500).json({ message: 'Server error', success: false });
  }
};

/**
 * @desc    Send OTP to user/vendor email for password reset
 * @route   POST /auth/send-reset-otp
 * @access  Public
 */
export const sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required", success: false });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email address", success: false });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    // Send Email
    const transporter = createMailTransport();
    const mailOptions = {
      from: `"EnviteYou Support" <theenviteyou@gmail.com>`,
      to: user.email,
      subject: "Password Reset OTP - EnviteYou",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #111;">Password Reset Request</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>You requested to reset your password. Use the following One-Time Password (OTP) to proceed:</p>
          <div style="background: #f4f4f5; padding: 15px; text-align: center; border-radius: 8px; font-size: 26px; font-weight: bold; letter-spacing: 6px; margin: 20px 0; color: #000;">
            ${otp}
          </div>
          <p style="font-size: 13px; color: #666;">This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
          <br/>
          <p style="font-size: 13px; color: #999;">Best regards,<br/>EnviteYou Team</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email successfully.",
    });
  } catch (error) {
    console.error("sendResetOtp error:", error);
    return res.status(500).json({ message: error.message || "Failed to send OTP", success: false });
  }
};

/**
 * @desc    Verify OTP for password reset
 * @route   POST /auth/verify-reset-otp
 * @access  Public
 */
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required", success: false });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });

    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    if (!user.resetOtp || user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP code", success: false });
    }

    if (!user.resetOtpExpires || new Date(user.resetOtpExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one.", success: false });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully.",
    });
  } catch (error) {
    console.error("verifyResetOtp error:", error);
    return res.status(500).json({ message: "Server error", success: false });
  }
};

/**
 * @desc    Reset password using verified OTP
 * @route   POST /auth/reset-password
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required", success: false });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long", success: false });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, "i") } });

    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    if (!user.resetOtp || user.resetOtp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP code", success: false });
    }

    if (!user.resetOtpExpires || new Date(user.resetOtpExpires).getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one.", success: false });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now log in.",
    });
  } catch (error) {
    console.error("resetPassword error:", error);
    return res.status(500).json({ message: "Server error", success: false });
  }
};