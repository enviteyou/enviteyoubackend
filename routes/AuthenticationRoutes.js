import {Router} from 'express';
import { googleLogin, loginUser, registerUser, loginAdmin, getCustomer,getAdmin,getVendor, logoutUser, registerVendor, loginVendor } from '../controllers/AuthenticationController.js';
import authUser from '../middleware/authenticate.js';
import authAdmin from '../middleware/authenticateAdmin.js';
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
router.get('/me',authUser, getCustomer);

// return current admin user from cookie token
router.get('/me-admin',authAdmin, getAdmin);

// return current vendor user from cookie token
router.get('/me-vendor', getVendor);



// logout current user and clear auth cookie
router.post('/logout', logoutUser);

// @route   POST /auth/google
// @desc    Google OAuth login
// @access  Public
router.post('/google', googleLogin);

export default router;