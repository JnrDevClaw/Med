import fp from 'fastify-plugin';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

/**
 * This plugin connects to Firestore using the Firebase client SDK.
 *
 * @see https://www.fastify.io/docs/latest/Reference/Plugins/
 */
async function firebasePlugin(fastify, options) {
	const firebaseConfig = {
		apiKey: process.env.VITE_FIREBASE_API_KEY,
		authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: process.env.VITE_FIREBASE_PROJECT_ID,
		storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: process.env.VITE_FIREBASE_APP_ID,
	};

	try {
		const firebaseApp = initializeApp(firebaseConfig);
		const firestore = getFirestore(firebaseApp);

		fastify.decorate('firestore', firestore);
		fastify.log.info('Successfully connected to Firestore.');
	} catch (err) {
		fastify.log.error('Failed to connect to Firestore', err);
		throw new Error('Failed to connect to Firestore.');
	}
}

export default fp(firebasePlugin, {
  name: 'firebase'
});