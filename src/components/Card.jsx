export default function Card({ title, children }) {
  return (
    <div className="bg-white shadow rounded p-6 mb-4">
      {title && <h2 className="font-bold text-lg mb-3">{title}</h2>}
      {children}
    </div>
  );
}
