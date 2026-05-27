import jwt from 'jsonwebtoken';
import User from '../models/user.js';
const authenticateVendor = async (req, res, next) => {
  try {
    const token = req.cookies?.vendorAccessToken || req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token provided', success: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const vendor = await User.findById(decoded.id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found', success: false });
    if(vendor.role !== 'vendor' && !vendor.isVendorAuthenticate){ 
      return res.status(403).json({ message: 'Forbidden - vendor only', success: false });
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('authenticateVendor error', error.message);
    return res.status(401).json({ message: 'Invalid token', success: false });
  }
};

export default authenticateVendor;