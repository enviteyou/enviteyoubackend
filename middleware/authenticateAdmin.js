import jwt from 'jsonwebtoken';

const authenticateAdmin = async (req, res, next) => {
  try {
    const token = req.cookies?.adminAccessToken || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided', success: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden - admin only', success: false });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('authenticateAdmin error', error.message);
    return res.status(401).json({ message: 'Invalid token', success: false });
  }
};

export default authenticateAdmin;
