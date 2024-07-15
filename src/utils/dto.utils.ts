import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ApiProperty } from '@nestjs/swagger';
import { ObjectID } from 'mongodb';

export enum TagType {
  subTopic = 'subTopic',
}

registerEnumType(TagType, {
  name: 'TagType',
});

@ObjectType()
export class Tag {
  @Field()
  _id?: ObjectID;

  @Field()
  @ApiProperty({ type: String })
  id: string;

  @Field(() => TagType)
  @ApiProperty({ enum: TagType })
  type: TagType;
}
