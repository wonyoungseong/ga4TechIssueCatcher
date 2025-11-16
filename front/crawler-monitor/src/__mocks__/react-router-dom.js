/**
 * Manual mock for react-router-dom
 * This resolves the Jest module resolution issue with react-router-dom v7
 */

import React from 'react';

const mockNavigate = jest.fn();

module.exports = {
  BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
  mockNavigate, // Export so tests can access it
};
