import User from '../models/user.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getUsersCount = async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getVendors = async (req, res) => {
  try {
    const vendors = await User.find({ role: 'vendor' }).select('-password');
    res.status(200).json(vendors);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateVendorAuthentication = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVendorAuthenticate } = req.body;

    const vendor = await User.findOne({ _id: id, role: 'vendor' });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found', success: false });
    }

    vendor.isVendorAuthenticate = Boolean(isVendorAuthenticate);
    await vendor.save();

    const safeVendor = await User.findById(vendor._id).select('-password');
    return res.status(200).json({ message: 'Vendor status updated', success: true, vendor: safeVendor });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', success: false });
  }
};
