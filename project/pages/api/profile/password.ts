import { NextApiRequest, NextApiResponse } from 'next';
import { databaseService } from '@/services/database';
import { verifyToken } from '@/services/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Password change API called, method:', req.method);
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify authentication
  const decoded = verifyToken(req) as { id: string; email: string; role: string } | null;
  console.log('Token decoded:', decoded ? `User ID: ${decoded.id}` : 'No token');
  
  if (!decoded) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    console.log('Password change request for user:', decoded.id);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const success = await databaseService.changePassword(decoded.id, currentPassword, newPassword);
    console.log('Password change result:', success);
    
    if (!success) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
