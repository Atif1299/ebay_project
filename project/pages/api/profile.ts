import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify authentication
  const decoded = verifyToken(req) as { id: string; email: string; role: string } | null;
  
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET - Get current user profile
  if (req.method === 'GET') {
    try {
      const user = await databaseService.getUserById(decoded.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      
      return res.status(200).json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT/PATCH - Update profile
  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { name, email } = req.body;

      if (!name && !email) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      // Prepare updates (don't allow role changes through this endpoint)
      const updates: { name?: string; email?: string } = {};
      if (name) updates.name = name;
      if (email) updates.email = email;

      // Check if email is being changed and if it's already taken
      if (email && email !== decoded.email) {
        const existingUser = await databaseService.getUserByEmail(email);
        if (existingUser && existingUser.id !== decoded.id) {
          return res.status(400).json({ error: 'Email is already in use' });
        }
      }

      const updatedUser = await databaseService.updateUser(decoded.id, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return updated user without password
      const { password: _, ...userWithoutPassword } = updatedUser;

      return res.status(200).json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Method not allowed
  res.setHeader('Allow', ['GET', 'PUT', 'PATCH']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
