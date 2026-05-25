import {Router} from 'express';
import { googleLogin, loginUser, registerUser, loginAdmin, getMe, registerVendor, loginVendor } from '../controllers/AuthenticationController.js';

const router = Router();

// @route   POST /auth/register  
// @desc    Register user
// @access  Public
router.post('/register', registerUser);

// @route   POST /auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginUser);

// @route   POST /auth/vendor/register
// @desc    Register vendor
// @access  Public
router.post('/vendor/register', registerVendor);

// @route   POST /auth/vendor/login
// @desc    Login vendor
// @access  Public
router.post('/vendor/login', loginVendor);

// admin login - returns 403 if credentials valid but user is not admin
router.post('/login-admin', loginAdmin);

// return current user from cookie token
router.get('/me', getMe);

// @route   POST /auth/google
// @desc    Google OAuth login
// @access  Public
router.post('/google', googleLogin);

export default router;