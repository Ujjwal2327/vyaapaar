import { PersonCard } from "./PersonCard";

export const PeopleContent = ({
  data,
  editMode,
  onEdit,
  onDelete,
  onViewDetails,
  availableCategories,
}) => {
  return (
    <div className="max-w-4xl mx-auto p-2">
      {data.length > 0 ? (
        <div className="flex flex-col gap-3">
          {data.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              editMode={editMode}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
              availableCategories={availableCategories}
            />
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">No contacts found</p>
        </div>
      )}
    </div>
  );
};
