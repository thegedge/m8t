export const truncate = (
  value: string,
  options: { length?: number; ellipsis?: string } = { length: 50, ellipsis: "..." },
) => {
  const { length = 50, ellipsis = "..." } = options;
  return value.length > length ? value.slice(0, length) + ellipsis : value;
};
