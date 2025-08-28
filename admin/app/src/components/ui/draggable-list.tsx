'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { twMerge } from 'tailwind-merge';

const cn = (...args: unknown[]) => {
  return twMerge(clsx(args));
};

export interface DraggableItemProps {
  id: string;
  content: React.JSX.Element;
}

export interface DraggableListProps {
  items: DraggableItemProps[];
  onChange?: (items: DraggableItemProps[]) => void;
  className?: string;
}

export const DraggableList: React.FC<DraggableListProps> = ({
  items: initialItems,
  onChange,
  className,
}) => {
  const [items, setItems] = useState(initialItems);
  const [draggedItem, setDraggedItem] = useState<DraggableItemProps | null>(
    null
  );
  const [dragOverItemId, setDragOverItemId] = useState<string | number | null>(
    null
  );

  const handleDragStart = (item: DraggableItemProps) => {
    setDraggedItem(item);
  };

  const handleDragOver = (e: React.DragEvent, itemId: string | number) => {
    e.preventDefault();
    setDragOverItemId(itemId);
  };

  const handleDragEnd = () => {
    if (!draggedItem || !dragOverItemId) {
      setDraggedItem(null);
      setDragOverItemId(null);
      return;
    }

    const newItems = [...items];
    const draggedIndex = items.findIndex((item) => item.id === draggedItem.id);
    const dropIndex = items.findIndex((item) => item.id === dragOverItemId);

    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);

    setItems(newItems);
    onChange?.(newItems);
    setDraggedItem(null);
    setDragOverItemId(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            draggable
            onDragStart={() => handleDragStart(item)}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragEnd={handleDragEnd}
            className={cn(
              'cursor-grab rounded-lg border border-primary/10 p-3 shadow-xs transition-colors',
              dragOverItemId === item.id &&
                'border-2 border-orange bg-secondary/40',
              draggedItem?.id === item.id &&
                'border-2 border-gray-400 opacity-50'
            )}
          >
            {item.content}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const DraggableItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div className={cn('flex gap-2 items-center', className)}>
      <div className="text-gray-400">≡</div>
      {children}
    </div>
  );
};
