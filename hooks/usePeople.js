import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth/AuthProvider";
import { photoCache } from "@/lib/utils/photoCache";

const DEFAULT_CATEGORIES = [
  { id: "customer", label: "Customer", isDefault: true },
  { id: "supplier", label: "Supplier", isDefault: true },
  { id: "helper", label: "Helper", isDefault: true },
  { id: "other", label: "Other", isDefault: true },
];

export const usePeople = () => {
  const { user, loading: authLoading } = useAuth();

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Data States
  const [peopleData, setPeopleData] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const hasFetchedDb = useRef(false);

  /**
   * Separate photos from contact data for storage
   * @param {Array} contacts - Contacts with photos
   * @returns {Object} { contactsWithoutPhotos, photos }
   */
  const separatePhotos = (contacts) => {
    const contactsWithoutPhotos = [];
    const photos = {};

    contacts.forEach((contact) => {
      const { photo, ...contactData } = contact;

      // Store contact without photo
      contactsWithoutPhotos.push({
        ...contactData,
        hasPhoto: !!photo, // Flag to indicate if photo exists
      });

      // Store photo separately if it exists
      if (photo) {
        photos[contact.id] = photo;
      }
    });

    return { contactsWithoutPhotos, photos };
  };

  /**
   * Merge photos back with contact data (used when saving)
   * @param {Array} contacts - Contacts without photos
   * @returns {Array} Contacts with photos
   */
  const mergePhotos = (contacts) => {
    return contacts.map((contact) => {
      const photo = photoCache.get(contact.id);
      const { hasPhoto, ...contactData } = contact;

      return {
        ...contactData,
        photo: photo || null,
      };
    });
  };

  // Helper to load from local storage
  const loadFromLocal = () => {
    const saved = localStorage.getItem("peopleData");
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        // Data is already stored without photos
        setPeopleData(parsedData);
        console.log(
          `Loaded ${parsedData.length} contacts from localStorage (without photos)`,
        );
      } catch (e) {
        console.error("Local parse error", e);
        setPeopleData([]);
      }
    }

    // Load categories from localStorage
    const savedCategories = localStorage.getItem("peopleCategories");
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (e) {
        console.error("Categories parse error", e);
        setCategories(DEFAULT_CATEGORIES);
      }
    }
  };

  // Load data when auth finishes loading
  useEffect(() => {
    const loadData = async () => {
      if (hasFetchedDb.current) {
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      if (authLoading) return;

      setIsDataLoading(true);
      hasFetchedDb.current = true;

      if (!user) {
        console.warn("No user found. Loading local data.");
        loadFromLocal();
        setIsDataLoading(false);
        setIsHydrated(true);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("people")
          .select("data, categories")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          console.log("People data loaded from Supabase");

          // Load people data
          if (data.data) {
            // Separate photos from contact data
            const { contactsWithoutPhotos, photos } = separatePhotos(data.data);

            // Store contacts without photos (fast)
            setPeopleData(contactsWithoutPhotos);
            localStorage.setItem(
              "peopleData",
              JSON.stringify(contactsWithoutPhotos),
            );

            // Store photos separately in cache
            photoCache.batchSet(photos);

            console.log(
              `Loaded ${contactsWithoutPhotos.length} contacts, ${Object.keys(photos).length} photos cached`,
            );
          }

          // Load categories
          if (data.categories) {
            setCategories(data.categories);
            localStorage.setItem(
              "peopleCategories",
              JSON.stringify(data.categories),
            );
          } else {
            setCategories(DEFAULT_CATEGORIES);
            localStorage.setItem(
              "peopleCategories",
              JSON.stringify(DEFAULT_CATEGORIES),
            );
          }
        } else {
          console.log("No DB entry found. Initializing...");
          loadFromLocal();
        }
      } catch (error) {
        console.error("DB Load Error:", error);
        loadFromLocal();
      } finally {
        setIsDataLoading(false);
        setIsHydrated(true);
      }
    };

    loadData();
  }, [user, authLoading]);

  // Save data to DB and local storage - NO TOAST LOGIC
  const savePeopleData = async (newData) => {
    if (!user) {
      throw new Error("NOT_AUTHENTICATED");
    }

    try {
      // Merge photos back with contact data for DB storage
      const dataWithPhotos = mergePhotos(newData);

      const { error } = await supabase.from("people").upsert(
        {
          user_id: user.id,
          data: dataWithPhotos,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        // Check for duplicate phone constraint violation
        if (
          error.code === "23505" ||
          error.message?.includes("Duplicate phone")
        ) {
          throw new Error("DUPLICATE_PHONE");
        }
        throw error;
      }

      // Store contacts without photos in localStorage (fast)
      const { contactsWithoutPhotos, photos } = separatePhotos(dataWithPhotos);
      localStorage.setItem("peopleData", JSON.stringify(contactsWithoutPhotos));

      // Update photo cache
      photoCache.batchSet(photos);

      // Update state with data without photos
      setPeopleData(contactsWithoutPhotos);

      console.log(
        `Saved ${contactsWithoutPhotos.length} contacts, ${Object.keys(photos).length} photos`,
      );
    } catch (error) {
      console.error("Save Error:", error);
      throw error; // Re-throw for container to handle
    }
  };

  // Save categories to DB and local storage - NO TOAST LOGIC
  const saveCategories = async (newCategories) => {
    if (!user) {
      throw new Error("NOT_AUTHENTICATED");
    }

    try {
      const { error } = await supabase.from("people").upsert(
        {
          user_id: user.id,
          categories: newCategories,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;

      localStorage.setItem("peopleCategories", JSON.stringify(newCategories));
      setCategories(newCategories);
    } catch (error) {
      console.error("Save Categories Error:", error);
      throw error; // Re-throw for container to handle
    }
  };

  return {
    peopleData,
    savePeopleData,
    categories,
    saveCategories,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    editMode,
    setEditMode,
    isHydrated,
    isDataLoading,
  };
};
