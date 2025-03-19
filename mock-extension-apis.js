global.chrome = {
  runtime: {
    getManifest: jest.fn(() => ({})),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};
