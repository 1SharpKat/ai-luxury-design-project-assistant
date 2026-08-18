/* =========================================================
   LuxNote
   Service call workflow lane
   ========================================================= */

(function addServiceCallStage() {
  const serviceStage = { id: "service_call", label: "Service Call" };

  if (typeof PROJECT_STAGES !== "undefined") {
    const alreadyExists = PROJECT_STAGES.some(
      (stage) => stage.id === serviceStage.id
    );

    if (!alreadyExists) {
      const completeIndex = PROJECT_STAGES.findIndex(
        (stage) => stage.id === "complete"
      );
      const insertAt = completeIndex >= 0
        ? completeIndex
        : PROJECT_STAGES.length;

      PROJECT_STAGES.splice(insertAt, 0, serviceStage);
    }
  }

  if (typeof LEGACY_STAGE_MAP !== "undefined") {
    LEGACY_STAGE_MAP.service = "service_call";
    LEGACY_STAGE_MAP.service_call = "service_call";
  }

  if (typeof stageById !== "undefined" && stageById?.set) {
    stageById.set(serviceStage.id, serviceStage);
  }

  if (typeof renderStageProgress === "function") {
    const renderStandardStageProgress = renderStageProgress;

    renderStageProgress = function renderServiceAwareStageProgress(stageId) {
      const cameThroughServiceCall =
        stageId === "service_call" ||
        (
          stageId === "complete" &&
          typeof projectRecords !== "undefined" &&
          Array.isArray(projectRecords) &&
          typeof stageIdFromRecord === "function" &&
          projectRecords.some(
            (record) => stageIdFromRecord(record) === "service_call"
          )
        );

      if (!cameThroughServiceCall) {
        renderStandardStageProgress(stageId);
        return;
      }

      if (typeof elements === "undefined" || !elements.stageProgress) {
        renderStandardStageProgress(stageId);
        return;
      }

      elements.stageProgress.replaceChildren();
      const serviceFlow = [
        { id: "service_call", label: "Service Call" },
        { id: "complete", label: "Complete" }
      ];
      const currentIndex = stageId === "complete" ? 1 : 0;

      serviceFlow.forEach((stage, index) => {
        const item = document.createElement("div");
        item.className = "detail-stage-item";

        if (index < currentIndex) {
          item.classList.add("is-complete");
        } else if (index === currentIndex) {
          item.classList.add("is-current");
        }

        const marker = document.createElement("span");
        marker.className = "detail-stage-marker";
        marker.textContent = index < currentIndex ? "✓" : String(index + 1);

        const label = document.createElement("span");
        label.textContent = stage.label;

        item.append(marker, label);
        elements.stageProgress.appendChild(item);
      });
    };
  }
})();
