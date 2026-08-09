describe('suite', () => {
  it('uses mocks', () => {
    const userMock = { id: 1 };
    const stubbedFetch = () => userMock;
    const setupHelper = () => ({});
    const useClient = () => ({});
    expect(stubbedFetch()).toBe(userMock);
    expect(setupHelper()).toEqual({});
    expect(useClient()).toEqual({});
  });
});
