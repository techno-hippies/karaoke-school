import React, { useState } from 'react';
import { useConnect, useConnectors, useAccount, useDisconnect } from 'wagmi';
import { VerticalFeed } from './feed/VerticalFeed';

const Homepage: React.FC = () => {
  return <VerticalFeed />;
};

export default Homepage;