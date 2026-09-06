import { installChatGptProtection } from '../adapters/chatgpt.js';
import { installConfiguredProtection } from './installProtection.js';

void installConfiguredProtection(installChatGptProtection);
