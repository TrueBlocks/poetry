import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GetItemImage, GetEnvVars } from "@wailsjs/go/main/App.js";

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

export function useEnvVars() {
  return useQuery({
    queryKey: ["envVars"],
    queryFn: GetEnvVars,
  });
}
