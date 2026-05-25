import express from 'express';
import { getUsers, getUsersCount, getVendors, updateVendorAuthentication } from '../controllers/UserController.js';
import authenticateAdmin from '../middleware/authenticateAdmin.js';

const router = express.Router();

router.get('/', authenticateAdmin, getUsers);
router.get('/count', authenticateAdmin, getUsersCount);
router.get('/vendors', authenticateAdmin, getVendors);
router.patch('/vendors/:id', authenticateAdmin, updateVendorAuthentication);

export default router;
