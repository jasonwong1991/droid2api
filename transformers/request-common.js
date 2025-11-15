import { logDebug } from '../logger.js';
import { getSystemPrompt, getUserAgentSync } from '../config.js';
import { filterMessages, filterText } from '../message-filter.js';
import { getSdkVersions, getClientEnvironment } from '../version-updater.js';

export function transformToCommon(openaiRequest) {
  logDebug('Transforming OpenAI request to Common format');
  
  // Filter messages to replace AI agent names with Droid
  const filteredMessages = filterMessages(openaiRequest.messages);

  // 基本保持 OpenAI 格式，只在 messages 前面插入 system 消息
  const commonRequest = {
    ...openaiRequest,
    messages: filteredMessages
  };

  const systemPrompt = getSystemPrompt();
  
  if (systemPrompt) {
    // 检查是否已有 system 消息
    const hasSystemMessage = commonRequest.messages?.some(m => m.role === 'system');
    
    if (hasSystemMessage) {
      // 如果已有 system 消息，在第一个 system 消息前插入我们的 system prompt
      commonRequest.messages = commonRequest.messages.map((msg, index) => {
        if (msg.role === 'system' && index === commonRequest.messages.findIndex(m => m.role === 'system')) {
          // 找到第一个 system 消息，前置我们的 prompt（并过滤用户提供的内容）
          const userContent = typeof msg.content === 'string' ? msg.content : '';
          return {
            role: 'system',
            content: systemPrompt + filterText(userContent)
          };
        }
        return msg;
      });
    } else {
      // 如果没有 system 消息，在 messages 数组最前面插入
      commonRequest.messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...(commonRequest.messages || [])
      ];
    }
  }

  logDebug('Transformed Common request', commonRequest);
  return commonRequest;
}

export function getCommonHeaders(authHeader, clientHeaders = {}) {
  // Generate unique IDs if not provided
  const sessionId = clientHeaders['x-session-id'] || generateUUID();
  const messageId = clientHeaders['x-assistant-message-id'] || generateUUID();
  
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'authorization': authHeader || '',
    'x-api-provider': 'baseten',
    'x-factory-client': 'cli',
    'x-session-id': sessionId,
    'x-assistant-message-id': messageId,
    'user-agent': getUserAgentSync(),
    'connection': 'keep-alive'
  };

  // Get dynamic SDK versions and environment
  const sdkVersions = getSdkVersions();
  const environment = getClientEnvironment();

  // Pass through Stainless SDK headers with dynamic defaults
  const stainlessDefaults = {
    'x-stainless-arch': environment.arch,
    'x-stainless-lang': 'js',
    'x-stainless-os': environment.os,
    'x-stainless-runtime': environment.runtime,
    'x-stainless-retry-count': '0',
    'x-stainless-package-version': sdkVersions.openai,
    'x-stainless-runtime-version': sdkVersions.runtime
  };

  // Copy Stainless headers from client or use defaults
  Object.keys(stainlessDefaults).forEach(header => {
    headers[header] = clientHeaders[header] || stainlessDefaults[header];
  });

  return headers;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
