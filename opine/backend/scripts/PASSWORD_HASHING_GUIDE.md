# Password Hashing Guide for User Creation Scripts

## Important: How Password Hashing Works in This System

### The Problem
When updating existing users, the Mongoose pre-save hook that automatically hashes passwords may not always work reliably, especially when using `save({ runValidators: false })` or when the password field isn't properly marked as modified.

### The Solution
**For updating existing users:** Always manually hash the password using `bcrypt` and use `User.updateOne()` to save it directly to the database. This bypasses Mongoose hooks but ensures the password is correctly hashed.

**For creating new users:** The pre-save hook should work, but always verify the password after creation.

### Code Pattern

```javascript
const bcrypt = require('bcryptjs');

// For updating existing users:
const salt = await bcrypt.genSalt(12); // Use 12 salt rounds (same as User model)
const hashedPassword = await bcrypt.hash(plainPassword, salt);

await User.updateOne(
  { _id: userId },
  {
    $set: {
      password: hashedPassword, // Manually hashed password
      // ... other fields
    }
  }
);

// Verify password works
const user = await User.findById(userId).select('+password');
const isValid = await user.comparePassword(plainPassword);
if (!isValid) {
  throw new Error('Password verification failed');
}
```

### Key Points

1. **Always use `bcrypt.genSalt(12)`** - This matches the User model's pre-save hook
2. **Use `User.updateOne()` for password updates** - This bypasses hooks and ensures direct database update
3. **Always verify the password after setting it** - Use `user.comparePassword()` to confirm it works
4. **For new users** - The pre-save hook should work, but verify after creation
5. **Never set plain passwords** - Always hash before saving

### Example: Complete User Update Script

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const updateUserPassword = async (userId, newPassword) => {
  // Hash password
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(newPassword, salt);
  
  // Update using updateOne
  await User.updateOne(
    { _id: userId },
    { $set: { password: hashedPassword } }
  );
  
  // Verify
  const user = await User.findById(userId).select('+password');
  const isValid = await user.comparePassword(newPassword);
  
  if (!isValid) {
    throw new Error('Password update failed verification');
  }
  
  return user;
};
```

### Testing Login

The login endpoint uses:
```javascript
const user = await User.findOne({ email }).select('+password');
const isValid = await user.comparePassword(password);
```

So the password must be properly hashed in the database for login to work.











