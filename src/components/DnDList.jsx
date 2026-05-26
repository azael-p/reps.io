import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'motion/react'

export default function DnDList({ items, onReorder, renderItem, idAccessor = 'id', style }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  function handleDragStart() {
    document.body.classList.add('dnd-active')
  }

  function handleDragEnd(event) {
    document.body.classList.remove('dnd-active')

    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex(i => i[idAccessor] === active.id)
    const newIndex = items.findIndex(i => i[idAccessor] === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordenados = arrayMove(items, oldIndex, newIndex)
      .map((item, i) => ({ ...item, orden: i }))
    onReorder(reordenados)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i[idAccessor])} strategy={verticalListSortingStrategy}>
        <div style={style}>
          <AnimatePresence>
            {items.map((item, i) => (
              <SortableItem key={item[idAccessor]} id={item[idAccessor]} orden={i + 1}>
                {renderItem(item, i)}
              </SortableItem>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 10 : 1,
  }

  return (
    <motion.div ref={setNodeRef} style={style} layout exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}>
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </motion.div>
  )
}

function arrayMove(arr, from, to) {
  const copy = [...arr]
  const [removed] = copy.splice(from, 1)
  copy.splice(to, 0, removed)
  return copy
}
