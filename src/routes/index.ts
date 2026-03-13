import { Router } from 'express';
import authRoutes from './auth.routes.js';
import storeRoutes from './store.routes.js';
import eventsRoutes from './events.routes.js';
import playerRoutes from './player.routes.js';
import paymentsRoutes from './payments.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/store', storeRoutes);
router.use('/events', eventsRoutes);
router.use('/player', playerRoutes);
router.use('/payments', paymentsRoutes);

export default router;
