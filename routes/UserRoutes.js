import express from 'express';
import { getUsers, getUsersCount } from '../controllers/UserController.js';

const router = express.Router();

router.get('/', getUsers);
router.get('/count', getUsersCount);

export default router;
