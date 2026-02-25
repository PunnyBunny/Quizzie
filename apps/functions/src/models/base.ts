import { db } from "../firebase";
export class BaseCollection<T extends FirebaseFirestore.DocumentData> {
  private readonly converter: FirebaseFirestore.FirestoreDataConverter<T>;
  constructor(
    private readonly collectionName: string,
    private readonly fromFirestore: (data: FirebaseFirestore.DocumentData) => T,
  ) {
    this.converter = {
      toFirestore: (doc: T) => doc,
      fromFirestore: (snapshot: FirebaseFirestore.QueryDocumentSnapshot) =>
        this.fromFirestore(snapshot.data()),
    };
  }
  /** Get the typed collection reference */
  collection() {
    return db.collection(this.collectionName).withConverter(this.converter);
  }
  /** Get a typed document reference */
  doc(id: string) {
    return this.collection().doc(id);
  }
}
