// Unified roles middleware helpers
module.exports.requireRole = function (...roles) {
  return (req, res, next) => {
    try {
      const role = req.user?.role;
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Authentication/Authorization error' });
    }
  };
};

module.exports.isAdmin = function (req) {
  const role = req.user?.role;
  return role === 'admin' || role === 'super_admin';
};

module.exports.isSuperAdmin = function (req) {
  return req.user?.role === 'super_admin';
};
