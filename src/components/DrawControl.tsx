"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useControl } from "react-map-gl/mapbox";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { ControlPosition } from "react-map-gl/mapbox";

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;
  singleFeature?: boolean;
  onCreate?: (event: MapboxDraw.DrawCreateEvent) => void;
  onUpdate?: (event: MapboxDraw.DrawUpdateEvent) => void;
  onDelete?: (event: MapboxDraw.DrawDeleteEvent) => void;
  onModeChange?: (event: MapboxDraw.DrawModeChangeEvent) => void;
};

export type DrawControlHandle = {
  finish: () => void;
};

const DrawControl = forwardRef<DrawControlHandle, DrawControlProps>(function DrawControl({
  position,
  singleFeature = true,
  onCreate,
  onUpdate,
  onDelete,
  onModeChange,
  ...drawOptions
}, ref) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const propsRef = useRef({ singleFeature, onCreate, onUpdate, onDelete, onModeChange });
  propsRef.current = { singleFeature, onCreate, onUpdate, onDelete, onModeChange };

  const handleCreate = (event: MapboxDraw.DrawCreateEvent) => {
    const { singleFeature: keepOneFeature, onCreate: notifyCreate } = propsRef.current;
    const draw = drawRef.current;

    if (!draw) return;

    if (keepOneFeature) {
      const currentIds = new Set(event.features.map((feature) => String(feature.id)));
      const previousIds = draw
        .getAll()
        .features.filter((feature) => !currentIds.has(String(feature.id)))
        .flatMap((feature) => (feature.id === undefined ? [] : [String(feature.id)]));

      if (previousIds.length) draw.delete(previousIds);
    }

    notifyCreate?.(event);
  };

  const handleUpdate = (event: MapboxDraw.DrawUpdateEvent) => {
    propsRef.current.onUpdate?.(event);
  };

  const handleDelete = (event: MapboxDraw.DrawDeleteEvent) => {
    propsRef.current.onDelete?.(event);
  };

  const handleModeChange = (event: MapboxDraw.DrawModeChangeEvent) => {
    propsRef.current.onModeChange?.(event);
  };

  useImperativeHandle(ref, () => ({
    finish() {
      const draw = drawRef.current;
      if (draw?.getMode().startsWith("draw_")) draw.changeMode("simple_select");
    },
  }), []);

  const draw = useControl<MapboxDraw>(
    () => new MapboxDraw(drawOptions),
    ({ map }) => {
      // Attach the stable listener functions
      map.on("draw.create", handleCreate);
      map.on("draw.update", handleUpdate);
      map.on("draw.delete", handleDelete);
      map.on("draw.modechange", handleModeChange);
    },
    ({ map }) => {
      // Cleanup the stable listener functions
      map.off("draw.create", handleCreate);
      map.off("draw.update", handleUpdate);
      map.off("draw.delete", handleDelete);
      map.off("draw.modechange", handleModeChange);
    },
    { position }
  );
  drawRef.current = draw;

  return null;
});

export default DrawControl;
