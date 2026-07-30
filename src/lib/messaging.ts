type SearchMessageResult = {
  id: string;
  conversation_id: string;
  message: string;
};

export async function searchMessages(userId: string, query: string): Promise<SearchMessageResult[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return [
    {
      id: `${userId}-${normalized}`,
      conversation_id: "search-result",
      message: `Search is available for “${query}” once message indexing is connected.`,
    },
  ];
}
