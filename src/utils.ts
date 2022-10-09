export function sortKeys<T extends { [key: string]: any }>(obj: T) {
  return Object.keys(obj)
    .sort()
    .reduce((total: T, current) => {
      return Object.assign(total, { [current]: obj[current] });
    }, Object.create(null));
}
