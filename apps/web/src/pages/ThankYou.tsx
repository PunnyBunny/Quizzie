import { useNavigate } from "react-router-dom";

export default function ThankYou() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold mb-6">Thank you!</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          Return Home
        </button>
      </div>
    </div>
  );
}
