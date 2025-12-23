import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetItemImage, GetCapabilities } from "@wailsjs/go/main/App.js";

export function useItemImage(itemId: number, itemType: string) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (itemType === "Writer") {
      GetItemImage(itemId).then((img) => {
        if (img && img.length > 0) {
          setImageUrl(img);
        }
      });
    }
  }, [itemId, itemType]);

  return imageUrl;
}

export function useCapabilities() {
  return useQuery({
    queryKey: ["capabilities"],
    queryFn: GetCapabilities,
  });
}
