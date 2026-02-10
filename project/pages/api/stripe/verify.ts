import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { databaseService } from '@/services/database';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
} as any); // Type cast to avoid version mismatch lint error

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const userId = session.metadata?.userId;
      const credits = session.metadata?.credits ? parseInt(session.metadata.credits) : 0;
      const expiresInDays = session.metadata?.expiresInDays ? parseInt(session.metadata.expiresInDays) : null;
      const transactionDescription = `Stripe Purchase: ${session.id}`;

      if (userId && credits > 0) {
        // Check if already processed (by webhook or previous verify)
        const alreadyExists = await databaseService.transactionExists(userId, transactionDescription);

        if (alreadyExists) {
            return res.status(200).json({ status: 'already_processed', message: 'Credits already added' });
        }

        // Process credit addition with expiration
        await databaseService.topUpCredits(userId, credits, transactionDescription, expiresInDays);
        return res.status(200).json({ status: 'success', message: 'Credits added successfully' });
      } else {
          return res.status(400).json({ error: 'Invalid session metadata' });
      }
    } else {
      return res.status(400).json({ error: 'Payment not completed', status: session.payment_status });
    }
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
}
