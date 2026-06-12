import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Tabs } from "@mantine/core";
import { IconBook, IconNetwork } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useEffect, useState } from "react";
import ItemDetail from "./ItemDetail";
import Graph from "./Graph";
import ItemEdit from "./ItemEdit";
import { GetEntity, SearchEntities } from "@wailsjs/go/services/EntityService";
import { useUI } from "@/contexts/UIContext";
import { LogError } from "@utils/logger";
import { db } from "@models";

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNewEntity = id === "new";
  const { setLastWordId, tabSelections, setTabSelection } = useUI();

  const [entity, setEntity] = useState<db.Entity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id && !isNewEntity) {
      GetEntity(Number(id))
        .then(setEntity)
        .catch((e: Error) => setError(e.message));
    }
  }, [id, isNewEntity]);

  useEffect(() => {
    if (error && id && !isNewEntity) {
      SearchEntities("poetry", "")
        .then((results) => {
          const poetryEntity = results?.[0];
          if (poetryEntity) {
            setLastWordId(poetryEntity.id);
            navigate(
              `/item/${poetryEntity.id}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
              { replace: true },
            );
            notifications.show({
              title: "Item Not Found",
              message: "Previous item no longer exists, showing: poetry",
              color: "yellow",
            });
          }
        })
        .catch((err) => LogError(`Failed to save last word: ${err}`));
    }
  }, [error, id, isNewEntity, navigate, searchParams, setLastWordId]);

  useEffect(() => {
    if (entity?.id && id && !isNewEntity) {
      setLastWordId(Number(id));
    }
  }, [id, entity?.id, isNewEntity, setLastWordId]);

  const tabFromUrl = searchParams.get("tab");
  const editModeFromUrl = searchParams.get("edit") === "true";
  const activeTab = tabFromUrl || tabSelections["itemView"] || "detail";
  const [isEditMode, setIsEditMode] = useState(editModeFromUrl || isNewEntity);

  // Update edit mode when URL changes
  useEffect(() => {
    setIsEditMode(editModeFromUrl || isNewEntity);
  }, [editModeFromUrl, isNewEntity]);

  // Sync active tab to store
  useEffect(() => {
    if (activeTab && activeTab !== tabSelections["itemView"]) {
      setTabSelection("itemView", activeTab);
    }
  }, [activeTab, tabSelections, setTabSelection]);

  const handleTabChange = (value: string | null) => {
    if (value) {
      // Clear edit mode when switching tabs
      setSearchParams({ tab: value });
      setIsEditMode(false);
    }
  };

  useEffect(() => {
    const onCycleTab = (e: Event) => {
      if ((e as CustomEvent).detail !== "itemView") return;
      setSearchParams({ tab: activeTab === "detail" ? "graph" : "detail" });
      setIsEditMode(false);
    };
    window.addEventListener("view:cycleTab", onCycleTab);
    return () => window.removeEventListener("view:cycleTab", onCycleTab);
  }, [activeTab, setSearchParams]);

  const handleEnterEditMode = () => {
    setSearchParams({ tab: "detail", edit: "true" });
    setIsEditMode(true);
  };

  const handleExitEditMode = () => {
    setSearchParams({ tab: "detail" });
    setIsEditMode(false);
  };

  return (
    <Tabs value={activeTab} onChange={handleTabChange}>
      <Tabs.List>
        <Tabs.Tab value="detail" leftSection={<IconBook size={16} />}>
          Detail
        </Tabs.Tab>
        <Tabs.Tab value="graph" leftSection={<IconNetwork size={16} />}>
          Graph
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="detail" pt="md">
        {isEditMode ? (
          <ItemEdit onSave={handleExitEditMode} onCancel={handleExitEditMode} />
        ) : (
          <ItemDetail onEnterEditMode={handleEnterEditMode} />
        )}
      </Tabs.Panel>

      <Tabs.Panel value="graph" pt="md">
        <Graph />
      </Tabs.Panel>
    </Tabs>
  );
}
