import {Router} from 'express';
import { googleLogin, loginUser, registerUser } from '../controllers/AuthenticationController.js';

const router = Router();

// @route   POST /auth/register  
// @desc    Register user
// @access  Public
router.post('/register', registerUser);

// @route   POST /auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginUser);

// @route   POST /auth/google
// @desc    Google OAuth login
// @access  Public
router.post('/google', googleLogin);

export default router;