import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

/**
 * Root Application Component
 * Delegates all client-side navigation, layouts, and route guards to React Router DOM.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
