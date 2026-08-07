const aiService = require('../src/services/aiService');

describe('aiService OpenRouter Integration', () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('should call OpenRouter API and return AI response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '喵嗚～ 我是雲喵！使用 DeepSeek V4 Flash 為你服務喔！😼💙'
            }
          }
        ]
      })
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('你好，介紹一下你自己！', contextUser);

    expect(global.fetch).toHaveBeenCalled();
    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    
    const body = JSON.parse(fetchArgs[1].body);
    expect(body.model).toBe('deepseek/deepseek-v4-flash-0731');
    expect(response).toContain('我是雲喵');
  });

  test('should handle tool calls correctly with OpenRouter', async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(async (url, options) => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: 'call_joke_1',
                      type: 'function',
                      function: {
                        name: 'get_random_joke',
                        arguments: '{}'
                      }
                    }
                  ]
                }
              }
            ]
          })
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '這裡有一個冷笑話喵！'
                }
              }
            ]
          })
        });
      }
    });

    const contextUser = { id: '123456789', username: 'testuser', displayName: '測試玩家' };
    const response = await aiService.generateAiResponse('講個笑話吧', contextUser);

    expect(callCount).toBe(2);
    expect(response).toBe('這裡有一個冷笑話喵！');
  });
});
