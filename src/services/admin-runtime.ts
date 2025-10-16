export const adminRuntime = {
  set: new Set<string>(),
  enable(userId: string) {
    this.set.add(userId);
  },
  disable(userId: string) {
    this.set.delete(userId);
  },
  isOn(userId: string) {
    return this.set.has(userId);
  },
};
